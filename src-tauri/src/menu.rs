use log::{error, info};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;

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

pub fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&view_logs)
        .separator()
        .item(&about)
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
            _ => {
                error!("Unknown option selected: {}", event.id().0.as_str());
            }
        },
    );

    return Ok(());
}
