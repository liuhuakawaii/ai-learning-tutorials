use wasm_bindgen::prelude::*;

/// RLE 压缩算法
#[wasm_bindgen]
pub fn rle_compress(data: &[u8]) -> Vec<u8> {
    if data.is_empty() {
        return vec![];
    }
    let mut result = Vec::new();
    let mut i = 0;
    while i < data.len() {
        let byte = data[i];
        let mut count = 1u8;
        while i + count as usize < data.len() && data[i + count as usize] == byte && count < 255 {
            count += 1;
        }
        result.push(count);
        result.push(byte);
        i += count as usize;
    }
    result
}

/// RLE 解压
#[wasm_bindgen]
pub fn rle_decompress(data: &[u8]) -> Vec<u8> {
    let mut result = Vec::new();
    let mut i = 0;
    while i + 1 < data.len() {
        let count = data[i];
        let byte = data[i + 1];
        for _ in 0..count {
            result.push(byte);
        }
        i += 2;
    }
    result
}

/// 计算数据的压缩率
#[wasm_bindgen]
pub fn compression_ratio(original_size: usize, compressed_size: usize) -> f64 {
    if original_size == 0 {
        return 0.0;
    }
    (1.0 - compressed_size as f64 / original_size as f64) * 100.0
}
