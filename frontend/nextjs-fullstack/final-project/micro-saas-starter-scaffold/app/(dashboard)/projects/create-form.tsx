'use client';

import { useState } from 'react';
import { createProjectAction } from './actions';

export function CreateProjectForm() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ errors?: Record<string, string>; success?: boolean }>({});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition"
      >
        新建项目
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold mb-4">新建项目</h2>
        <form
          action={async (formData) => {
            const result = await createProjectAction(null, formData);
            if (result?.success) {
              setOpen(false);
              setState({});
            } else {
              setState(result || {});
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">项目名称</label>
            <input
              id="name"
              name="name"
              required
              maxLength={100}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="输入项目名称"
            />
            {state.errors?.name && (
              <p className="mt-1 text-xs text-red-600">{state.errors.name}</p>
            )}
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">状态</label>
            <select
              id="status"
              name="status"
              defaultValue="draft"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="draft">草稿</option>
              <option value="active">活跃</option>
            </select>
          </div>
          {state.errors?._form && (
            <p className="text-sm text-red-600">{state.errors._form}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition"
            >
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
