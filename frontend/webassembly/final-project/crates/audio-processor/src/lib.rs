use wasm_bindgen::prelude::*;

/// 音量调节
#[wasm_bindgen]
pub fn adjust_volume(data: &[f32], gain: f32) -> Vec<f32> {
    data.iter().map(|&s| (s * gain).clamp(-1.0, 1.0)).collect()
}

/// 变速处理（简单重采样）
#[wasm_bindgen]
pub fn change_speed(data: &[f32], speed: f32) -> Vec<f32> {
    let out_len = (data.len() as f32 / speed) as usize;
    (0..out_len)
        .map(|i| {
            let src_idx = ((i as f32 * speed) as usize).min(data.len() - 1);
            data[src_idx]
        })
        .collect()
}

/// 音频反转
#[wasm_bindgen]
pub fn reverse_audio(data: &[f32]) -> Vec<f32> {
    data.iter().rev().cloned().collect()
}

/// 淡入淡出
#[wasm_bindgen]
pub fn apply_fade(data: &[f32], fade_ratio: f32) -> Vec<f32> {
    let len = data.len();
    let fade_len = (len as f32 * fade_ratio) as usize;
    data.iter()
        .enumerate()
        .map(|(i, &s)| {
            let gain = if i < fade_len {
                i as f32 / fade_len as f32
            } else if i > len - fade_len {
                (len - i) as f32 / fade_len as f32
            } else {
                1.0
            };
            s * gain
        })
        .collect()
}
