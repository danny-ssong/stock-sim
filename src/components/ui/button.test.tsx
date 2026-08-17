import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('children을 렌더링한다', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });

  it('클릭 핸들러가 호출된다', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disabled면 클릭해도 핸들러가 호출되지 않는다', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        저장
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
