use image_processor::*;

#[test]
fn test_process_image_grayscale() {
    let pixels = vec![255u8, 0, 0, 255, 0, 255, 0, 255];
    let result = process_image(&pixels, 2, 1, "grayscale", 100.0);
    assert_eq!(result.len(), 8);
    // 灰度化后 R=G=B
    assert_eq!(result[0], result[1]);
    assert_eq!(result[1], result[2]);
}

#[test]
fn test_process_image_brightness() {
    let pixels = vec![100u8, 100, 100, 255];
    let result = process_image(&pixels, 1, 1, "brightness", 80.0);
    assert!(result[0] > 100);
}

#[test]
fn test_process_image_unknown_filter() {
    let pixels = vec![100u8, 100, 100, 255];
    let result = process_image(&pixels, 1, 1, "unknown", 50.0);
    assert_eq!(result, pixels);
}
