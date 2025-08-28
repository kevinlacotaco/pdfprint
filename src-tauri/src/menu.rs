use std::sync::Mutex;

use log::{error, info, warn};
use serde::Serialize;
use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::mutex_utils::LockResultExt;

fn open_folder_handler(app: &tauri::AppHandle) {
    let handle_clone: tauri::AppHandle = app.app_handle().clone();
    app.dialog()
        .file()
        .pick_folder(move |file_path: Option<tauri_plugin_fs::FilePath>| {
            if let Some(path) = file_path {
                let _ = handle_clone.emit("folder-chosen", path.to_string());
            }
        });
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    version: String,
    current_version: String,
}

pub struct PendingUpdate(Mutex<Option<Update>>);

impl PendingUpdate {
    pub const fn new(mutex: Mutex<Option<Update>>) -> Self {
        return Self(mutex);
    }
}

pub fn remove_submenu_by_id<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    menu_name: &str,
    id: &str,
) -> Result<(), tauri::Error> {
    let Some(root) = app.menu() else {
        return Ok(());
    };

    if let Some(top_level_menu) = root.get(menu_name) {
        if let Some(submenu) = top_level_menu.as_submenu() {
            if let Some(menu_item) = submenu.get(id) {
                submenu.remove(&menu_item)?;
            }
        }
    }

    return Ok(());
}

pub fn add_menu_item_to_submenu_at<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    menu_name: &str,
    menu_item: &MenuItem<R>,
    at: usize,
) -> Result<(), tauri::Error> {
    let Some(root) = app.menu() else {
        return Ok(());
    };

    if let Some(top_level_menu) = root.get(menu_name) {
        // Check if it exists before adding it
        if let Some(submenu) = top_level_menu.as_submenu() {
            if submenu.get(menu_item.id()).is_none() {
                submenu.insert(menu_item, at)?;
            }
        }
    }

    return Ok(());
}

async fn check_for_update(
    app: &tauri::AppHandle,
) -> Result<Option<UpdateMetadata>, tauri_plugin_updater::Error> {
    let pending_update = app.state::<PendingUpdate>().clone();

    let update = app.updater()?.check().await?;

    let update_metadata = update.as_ref().map(|update| {
        return UpdateMetadata {
            version: update.version.clone(),
            current_version: update.current_version.clone(),
        };
    });
    warn!("{update_metadata:?}");

    let Ok(mut mut_state) = pending_update.0.lock() else {
        warn!("Could not acquire lock!");
        return Ok(None);
    };

    *mut_state = update;

    if let Some(data) = &update_metadata {
        let is_greater = data.version > data.current_version;
        if is_greater {
            let download_and_install = MenuItemBuilder::new("Download update")
                .id("download_and_install")
                .build(app)?;

            let _ = add_menu_item_to_submenu_at(app, "help", &download_and_install, 5);
        } else {
            let _ = remove_submenu_by_id(app, "help", "download_update");
        }
    }

    return Ok(update_metadata);
}

async fn download_and_install(app: &tauri::AppHandle) {
    let pending_update = app.state::<PendingUpdate>().clone();
    let lock = pending_update.0.lock().read_or_panic().take();

    if let Some(updater_set) = lock {
        let mut downloaded = 0;

        let _ = updater_set
            .download_and_install(
                |chunk_length, _content_length| {
                    downloaded += chunk_length;
                },
                || {},
            )
            .await;

        app.restart()
    }
}

pub fn setup_menu(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let open_folder = MenuItemBuilder::new("Open Folder...")
        .id("open_folder")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&open_folder)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .quit()
        .build()?;

    let view_logs = MenuItemBuilder::new("View Logs...")
        .id("view_logs")
        .build(app)?;

    let about = MenuItemBuilder::new("About").id("about").build(app)?;

    let check_for_updates = MenuItemBuilder::new("Check for Updates")
        .id("check_for_updates")
        .build(app)?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .id("help")
        .item(&view_logs)
        .separator()
        .item(&about)
        .separator()
        .item(&check_for_updates)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&file_submenu, &help_submenu])
        .build()?;

    app.set_menu(menu)?;

    // listen for menu item click events
    app.on_menu_event(
        move |app: &tauri::AppHandle, event: tauri::menu::MenuEvent| match event.id().0.as_str() {
            "open_folder" => {
                open_folder_handler(app);
            }
            "view_logs" => {
                info!("Opening logs");
                if let Ok(path) = app.app_handle().path().app_log_dir() {
                    let app_name = &app.app_handle().package_info().name;
                    let log_path = path.join(format!("{app_name}.log"));

                    let _ = app
                        .opener()
                        .open_path(log_path.to_string_lossy(), None::<&str>);
                }
            }
            "about" => {
                let package_info = app.app_handle().package_info();
                let app_name = &package_info.name.clone();
                let version = &package_info.version.clone();
                let author = &package_info.authors;

                app.dialog()
                    .message(format!("Version: {version}\nAuthor: {author}"))
                    .kind(MessageDialogKind::Info)
                    .title(app_name)
                    .buttons(MessageDialogButtons::Ok)
                    .show(|_res| info!("Closing about dialog"));
            }
            "check_for_updates" => {
                let clone = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = check_for_update(&clone).await;
                });
            }
            "download_and_install" => {
                let clone = app.clone();
                tauri::async_runtime::spawn(async move {
                    let () = download_and_install(&clone).await;
                });
            }
            _ => {
                error!("Unknown option selected: {}", event.id().0.as_str());
            }
        },
    );

    return Ok(());
}
