use mupdf::pdf::{PdfDocument, PdfGraftMap, PdfObject};
use mupdf::Size;

use std::path::PathBuf;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct PdfPrintDetails {
    name: String,
    pages: i32,
    size: u64,
    path: String,
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

pub fn create_combined_pdf(pdfs: Vec<PdfPrintDetails>) -> Result<PdfDocument, String> {
    let mut temp_doc: PdfDocument = PdfDocument::new();

    for pdf_detail in pdfs {
        let pdf_path: PathBuf = PathBuf::from(pdf_detail.path);
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
