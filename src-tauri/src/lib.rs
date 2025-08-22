use core::fmt;
use mupdf::pdf::{PdfDocument, PdfGraftMap, PdfObject};
use mupdf::Size;
use printers::common::base::job::PrinterJobOptions;
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri_plugin_log::fern::FormatCallback;
use tauri_plugin_log::TimezoneStrategy;
use tauri_plugin_updater::UpdaterExt;
use tempfile::NamedTempFile;
use time::macros::format_description;

use log::{error, info, warn, Record};
use std::fs::{create_dir_all, read_dir};
use std::time::Duration;
use tauri::path::PathResolver;
use tauri::{Emitter, Listener, Manager};

mod file_utils;
mod menu;

#[derive(Default, serde::Serialize, serde::Deserialize, Debug, Clone)]
struct AppState {
    workspace: Option<String>,
}

#[derive(serde::Serialize)]
struct PdfDetails {
    name: String,
    pages: i32,
    size: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct PdfPrintDetails {
    name: String,
    pages: i32,
    size: u64,
    print_range: Option<Vec<i32>>,
}

fn add_page_to(
    destination_doc: &mut PdfDocument,
    src_page: &PdfObject,
    graft_map: &mut PdfGraftMap,
) -> Result<PdfObject, mupdf::Error> {
    let mut dst_page = destination_doc.new_dict()?;
    dst_page.dict_put("Type", destination_doc.new_name("Page")?)?;

    let dicts = ["MediaBox", "Rotate", "Resources", "Contents"];

    for dict_key in dicts {
        if let Ok(Some(dict)) = src_page.get_dict(dict_key) {
            let media_box = dict;
            let grafted = graft_map.graft_object(&media_box)?;
            dst_page.dict_put(dict_key, grafted)?;
        }
    }

    return destination_doc.add_object(&dst_page);
}

fn process_folder(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let handle_clone = app_handle.clone();
    let state = app_handle.state::<Mutex<AppState>>();

    let workspace = state
        .lock()
        .map_err(|e| return e.to_string())?
        .workspace
        .clone()
        .ok_or_else(|| return "No workspace set".to_string())?;
    let workspace_path = Path::new(&workspace);

    let entries: std::fs::ReadDir = read_dir(workspace_path).map_err(|e| return e.to_string())?;

    let pdfs: Vec<PdfDetails> = entries
        .filter(|entry| {
            return entry.as_ref().is_ok_and(|entry| {
                return file_utils::get_extension_from_filename(
                    &entry.file_name().to_string_lossy(),
                )
                .unwrap_or("")
                    == "pdf";
            });
        })
        .filter_map(|entry: Result<std::fs::DirEntry, std::io::Error>| {
            return entry.map_or(None, |dir_entry| {
                let name: String = dir_entry.file_name().to_string_lossy().to_string();
                let metadata: std::fs::Metadata = dir_entry.metadata().ok()?;
                let size: u64 = metadata.len();
                let document =
                    PdfDocument::open(&dir_entry.path().as_path().to_string_lossy()).ok()?;

                let pages = document.page_count().unwrap_or(0);

                return Some(PdfDetails { name, pages, size });
            });
        })
        .collect();

    handle_clone
        .emit("folder-processed", &pdfs)
        .map_err(|e| return e.to_string())?;

    return Ok(());
}

fn create_combined_pdf(root: &Path, pdfs: Vec<PdfPrintDetails>) -> Result<PdfDocument, String> {
    let mut temp_doc: PdfDocument = PdfDocument::new();

    for pdf_detail in pdfs {
        let pdf_path: PathBuf = root.join(PathBuf::from(pdf_detail.name));
        let pdf_doc: PdfDocument =
            PdfDocument::open(&pdf_path.to_string_lossy()).map_err(|e| return e.to_string())?;
        let range: i32 = pdf_doc.page_count().map_err(|e| return e.to_string())?;
        let mut graft_map: PdfGraftMap =
            temp_doc.new_graft_map().map_err(|e| return e.to_string())?;

        let default_vec = (0..range).collect();

        let pages = pdf_detail.print_range.unwrap_or(default_vec);

        for i in &pages {
            let page: PdfObject = pdf_doc.find_page(*i).map_err(|e| return e.to_string())?;

            let obj: PdfObject = add_page_to(&mut temp_doc, &page, &mut graft_map)
                .map_err(|e| return e.to_string())?;
            temp_doc
                .insert_page(temp_doc.page_count().unwrap_or(0), &obj)
                .map_err(|e| return e.to_string())?;
        }

        if pages.len() % 2 == 1 {
            temp_doc
                .new_page(Size::LETTER)
                .map_err(|e| return e.to_string())?;
        }
    }

    return Ok(temp_doc);
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn frontend_ready(app_handle: tauri::AppHandle) {
    if let Err(err) = process_folder(&app_handle) {
        error!("{err}");
    }
}

#[tauri::command(rename_all = "snake_case")]
#[allow(clippy::needless_pass_by_value)]
fn print_to_default(
    app_handle: tauri::AppHandle,
    pdfs: Vec<PdfPrintDetails>,
) -> Result<(), String> {
    let state = app_handle.state::<Mutex<AppState>>();

    let workspace = state
        .lock()
        .map_err(|e| return e.to_string())?
        .workspace
        .clone()
        .ok_or_else(|| return "No workspace set".to_string())?;
    let workspace_path = Path::new(&workspace);

    let combined_doc = create_combined_pdf(workspace_path, pdfs)?;

    // Create a temporary file to then send to a printer
    let file = NamedTempFile::with_suffix(".pdf").map_err(|e| return e.to_string())?;
    let real_file = file.as_file();
    let mut writer = BufWriter::new(real_file);
    let file_path = file.path().to_owned();

    combined_doc
        .write_to(&mut writer)
        .map_err(|e| return e.to_string())?;
    writer.flush().map_err(|e| return e.to_string())?;
    drop(writer);

    let def_printer = printers::get_default_printer()
        .ok_or_else(|| return "Could not get default printer".to_string())?;

    let job = def_printer.print_file(
        &file_path.to_string_lossy(),
        PrinterJobOptions {
            name: Some("Pet Print PDF Job"),
            raw_properties: &[],
        },
    )?;
    file.keep().map_err(|e| return e.to_string())?;

    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(500));

        for _i in 0..10 {
            let active_jobs = def_printer.get_active_jobs();
            let job_is_active = active_jobs
                .iter()
                .any(|active_job| return active_job.id == job);
            if job_is_active {
                interval.tick().await;
            } else {
                let _ = app_handle.emit("printing_completed", ());
                break;
            }
        }

        drop(interval);
    });

    return Ok(());
}

#[tauri::command(rename_all = "snake_case")]
#[allow(clippy::needless_pass_by_value)]
fn save_to_file(
    app_handle: tauri::AppHandle,
    pdfs: Vec<PdfPrintDetails>,
    file: String,
) -> Result<(), String> {
    let state = app_handle.state::<Mutex<AppState>>();

    let workspace = state
        .lock()
        .map_err(|e| return e.to_string())?
        .workspace
        .clone()
        .ok_or_else(|| return "No workspace set".to_string())?;
    let workspace_path = Path::new(&workspace);

    let combined_doc_result = create_combined_pdf(workspace_path, pdfs);
    let Ok(combined_doc) = combined_doc_result else {
        // Swallow error, just do not try to write
        return Ok(());
    };
    let file_to_save = File::create(&file).map_err(|e| return e.to_string())?;
    let mut writer = BufWriter::new(file_to_save);

    combined_doc
        .write_to(&mut writer)
        .map_err(|e| return e.to_string())?;
    writer.flush().map_err(|e| return e.to_string())?;
    drop(writer);

    return Ok(());
}

async fn update(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    if cfg!(not(debug_assertions)) {
        info!("Checking for update");
        if let Some(update) = app.updater()?.check().await? {
            let mut downloaded = 0;

            // alternatively we could also call update.download() and update.install() separately
            update
                .download_and_install(
                    |chunk_length, _content_length| {
                        downloaded += chunk_length;
                    },
                    || {},
                )
                .await?;

            app.restart();
        }
    } else {
        info!("Skipping update check");
    }
    return Ok(());
}

fn formatter(out: FormatCallback, message: &fmt::Arguments, record: &Record) {
    let format = format_description!("[year]-[month]-[day] [hour]:[minute]:[second]");

    out.finish(format_args!(
        "[{}][{}][{}:{}][{}] {}",
        TimezoneStrategy::UseUtc
            .get_now()
            .format(&format)
            .as_ref()
            .map_or("no date", |t| return t),
        record.target(),
        record.file().map_or("not found", |f| return f),
        record
            .line()
            .as_ref()
            .map_or("no line".to_string(), |l| return l.to_string()),
        record.level(),
        message
    ));
}

fn load_workspace(app_handle: &tauri::AppHandle, workspace_json: &PathBuf) {
    if let Ok(file) = File::open(workspace_json) {
        let mut reader = BufReader::new(file);
        let mut string = String::new();
        if let Ok(res) = reader.read_to_string(&mut string) {
            if res > 0 {
                if let Ok(deserialized) = serde_json::from_str::<AppState>(&string) {
                    let handle_clone = app_handle.clone();
                    let state = handle_clone.state::<Mutex<AppState>>();
                    if let Ok(mut state) = state.lock() {
                        *state = deserialized;
                    }
                    let _ = handle_clone.emit("state-loaded", ());
                }
            }
        }
    }
}

fn folder_chosen(app_handle: &tauri::AppHandle, path: String, workspace_json: &PathBuf) {
    let handle_clone = app_handle.clone();
    let state = handle_clone.state::<Mutex<AppState>>();

    let Ok(mut mut_state) = state.lock() else {
        warn!("Could not acquire lock!");
        return;
    };
    mut_state.workspace = Some(path);
    let clone = mut_state.clone();

    match File::create(workspace_json) {
        Ok(file) => {
            let mut writer = BufWriter::new(file);
            if serde_json::to_writer(&mut writer, &clone).is_ok() && writer.flush().is_ok() {
                info!("Emitting update");
                let _ = handle_clone.emit("state-updated", ());
            }
        }
        Err(err) => {
            error!("{err}");
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
#[allow(clippy::needless_pass_by_value)]
fn select_workspace(app_handle: tauri::AppHandle, file: String) -> Result<(), String> {
    let app_data = PathResolver::app_data_dir(app_handle.path())
        .map_err(|_| return "Failed to get app data directory".to_string())?;
    let workspace_json = app_data.join("workspace.json");
    folder_chosen(&app_handle, file, &workspace_json);

    return Ok(());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::missing_panics_doc)]
pub fn run() {
    #[allow(clippy::expect_used)]
    #[allow(clippy::large_stack_frames)]
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .max_file_size(50_000 /* bytes */)
                .format(formatter)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(Mutex::new(AppState::default()))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app: &mut tauri::App| {
            let app_data = PathResolver::app_data_dir(app.path())
                .map_err(|_| return "Failed to get app data directory".to_string())?;
            let workspace_json = app_data.join("workspace.json");

            if !app_data.exists() {
                info!("No app data directory found. Creating it.");
                create_dir_all(&app_data)?;
            }

            let events = ["state-loaded", "state-updated"];
            for event in events {
                let handle_clone: tauri::AppHandle = app.handle().clone();

                app.handle().listen(event, move |_event| {
                    if let Err(err) = process_folder(&handle_clone) {
                        error!("{err}");
                    }
                });
            }

            // Load workspace state from file if it exists
            load_workspace(app.handle(), &workspace_json);

            let _ = menu::setup_menu(app).map_err(|_| return "Failed to setup menu".to_string());

            {
                let handle_clone = app.handle().clone();
                app.handle().listen("folder-chosen", move |event| {
                    if let Ok(path) = serde_json::from_str::<String>(event.payload()) {
                        folder_chosen(&handle_clone, path, &workspace_json);
                    }
                });
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = update(handle).await;
            });

            info!("All set up!");

            return Ok(());
        })
        .invoke_handler(tauri::generate_handler![
            frontend_ready,
            print_to_default,
            save_to_file,
            select_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
