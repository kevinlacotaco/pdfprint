use std::{ffi::OsStr, path::Path};

/// Utility function for getting the extension from a file name
pub fn get_extension_from_filename(filename: &str) -> Option<&str> {
    return Path::new(filename).extension().and_then(OsStr::to_str);
}
