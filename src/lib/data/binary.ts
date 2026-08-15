/** 계산은 f64로 하고 저장만 f32로 줄인다. JSON 대비 약 1/5 크기다. */
export function encodeSeries(values: Float64Array): Buffer {
  const f32 = Float32Array.from(values);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

/**
 * f32 바이너리를 복호화한다.
 *
 * fetch().arrayBuffer()는 순수 ArrayBuffer를 주지만, Node의 fs.readFile은
 * Buffer(=Uint8Array 뷰)를 준다. Buffer를 TypedArray 생성자에 그대로 넘기면
 * 바이트를 재해석하지 않고 각 바이트 값을 개별 숫자로 취급해버려 값이 깨진다.
 * 뷰가 들어오면 내부 ArrayBuffer와 byteOffset을 꺼내 재구성한다.
 */
export function decodeSeries(buffer: ArrayBufferLike | ArrayBufferView): Float32Array {
  if (ArrayBuffer.isView(buffer)) {
    return new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
  }
  return new Float32Array(buffer);
}
