use wasm_bindgen::prelude::*;

/// 灰度化滤镜
fn apply_grayscale(pixels: &mut [u8], width: usize, height: usize, intensity: f32) {
    let factor = intensity / 100.0;
    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * 4;
            let r = pixels[idx] as f32;
            let g = pixels[idx + 1] as f32;
            let b = pixels[idx + 2] as f32;
            let gray = r * 0.299 + g * 0.587 + b * 0.114;
            pixels[idx] = (r + (gray - r) * factor) as u8;
            pixels[idx + 1] = (g + (gray - g) * factor) as u8;
            pixels[idx + 2] = (b + (gray - b) * factor) as u8;
        }
    }
}

/// 模糊滤镜（均值模糊）
fn apply_blur(pixels: &mut [u8], width: usize, height: usize, intensity: f32) {
    let radius = (intensity / 20.0).max(1.0) as i32;
    let src = pixels.to_vec();
    for y in radius..(height as i32 - radius) {
        for x in radius..(width as i32 - radius) {
            let (mut r_sum, mut g_sum, mut b_sum) = (0u32, 0u32, 0u32);
            let mut count = 0u32;
            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    let sy = (y + dy) as usize;
                    let sx = (x + dx) as usize;
                    let idx = (sy * width + sx) * 4;
                    r_sum += src[idx] as u32;
                    g_sum += src[idx + 1] as u32;
                    b_sum += src[idx + 2] as u32;
                    count += 1;
                }
            }
            let idx = (y as usize * width + x as usize) * 4;
            pixels[idx] = (r_sum / count) as u8;
            pixels[idx + 1] = (g_sum / count) as u8;
            pixels[idx + 2] = (b_sum / count) as u8;
        }
    }
}

/// 亮度调节
fn apply_brightness(pixels: &mut [u8], _width: usize, _height: usize, intensity: f32) {
    let adjust = (intensity - 50.0) * 2.55;
    for i in (0..pixels.len()).step_by(4) {
        pixels[i] = (pixels[i] as f32 + adjust).clamp(0.0, 255.0) as u8;
        pixels[i + 1] = (pixels[i + 1] as f32 + adjust).clamp(0.0, 255.0) as u8;
        pixels[i + 2] = (pixels[i + 2] as f32 + adjust).clamp(0.0, 255.0) as u8;
    }
}

/// 对外暴露的图像处理函数
#[wasm_bindgen]
pub fn process_image(
    data: &[u8],
    width: usize,
    height: usize,
    filter_type: &str,
    intensity: f32,
) -> Vec<u8> {
    let mut pixels = data.to_vec();
    match filter_type {
        "grayscale" => apply_grayscale(&mut pixels, width, height, intensity),
        "blur" => apply_blur(&mut pixels, width, height, intensity),
        "brightness" => apply_brightness(&mut pixels, width, height, intensity),
        _ => {}
    }
    pixels
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grayscale() {
        let mut pixels = vec![255u8, 0, 0, 255, 0, 255, 0, 255];
        apply_grayscale(&mut pixels, 2, 1, 100.0);
        assert_eq!(pixels[0], pixels[1]);
        assert_eq!(pixels[1], pixels[2]);
    }
}
