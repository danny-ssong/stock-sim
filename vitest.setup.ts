import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// vitest.config.ts에서 test.globals를 켜지 않았기 때문에 @testing-library/react의
// 자동 afterEach cleanup(전역 afterEach 존재 여부로 감지)이 등록되지 않는다.
// 명시적으로 각 테스트 뒤 렌더 트리를 정리해 테스트 간 DOM 누적을 막는다.
afterEach(() => {
  cleanup();
});
