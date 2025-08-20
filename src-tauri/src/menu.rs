use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

fn open_folder_handler(app: &tauri::AppHandle) {
    let handle_clone: tauri::AppHandle = app.app_handle().clone();
    app.dialog()
        .file()
        .pick_folder(move |file_path: Option<tauri_plugin_fs::FilePath>| {
            let str = file_path
                .as_ref()
                .and_then(|x| return x.as_path())
                .map(|path| return path.as_os_str().to_string_lossy());

            let _ = handle_clone.emit("folder-chosen", str);
        });
}

pub fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open_folder = MenuItemBuilder::new("Open Folder...")
        .id("open-folder")
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

    let menu = MenuBuilder::new(app).items(&[&file_submenu]).build()?;

    app.set_menu(menu)?;

    // listen for menu item click events
    app.on_menu_event(
        move |app: &tauri::AppHandle, event: tauri::menu::MenuEvent| match event.id().0.as_str() {
            "open-folder" => {
                open_folder_handler(app);
            }
            _ => {
                println!("Unknown menu item clicked: {}", event.id().0);
            }
        },
    );

    return Ok(());
}
