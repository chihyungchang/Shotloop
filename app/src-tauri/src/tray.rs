//! The menu bar icon: a template S (design/logo/tray.svg) with the number
//! of active jobs beside it, and a menu with the queue's state, Show
//! Shotloop and Quit. The UI sends the menu's words in its language
//! (set_tray_text); English until it does.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Manager, Wry};

pub struct Tray {
    icon: TrayIcon,
    status: MenuItem<Wry>,
    show: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

pub fn create(app: &AppHandle) -> tauri::Result<Tray> {
    let status = MenuItem::with_id(app, "status", "Nothing running", false, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show Shotloop", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Shotloop", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&status, &PredefinedMenuItem::separator(app)?, &show, &quit])?;
    let icon = TrayIconBuilder::with_id("main")
        .icon(tauri::include_image!("icons/tray.png"))
        .icon_as_template(true)
        .tooltip("Shotloop")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(Tray { icon, status, show, quit })
}

/// Bring the main window back (it hides rather than closes)
pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// The number of running and queued jobs beside the icon; nothing when idle
pub fn set_count(app: &AppHandle, n: usize) {
    if let Some(t) = app.try_state::<Tray>() {
        let _ = t.icon.set_title(if n > 0 { Some(n.to_string()) } else { None });
    }
}

#[tauri::command]
pub fn set_tray_text(app: AppHandle, status: String, show: String, quit: String) {
    if let Some(t) = app.try_state::<Tray>() {
        let _ = t.status.set_text(status);
        let _ = t.show.set_text(show);
        let _ = t.quit.set_text(quit);
    }
}
