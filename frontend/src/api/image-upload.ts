import { api } from './client';
import type { ApiResponse } from '../types/api';

// postForm overrides the JSON client default and lets the browser attach the
// multipart boundary. All profile and publication panels share this contract.
export function uploadImage<T>(endpoint: string, file: File, version: number) {
  const data = new FormData();
  data.append('image', file);
  data.append('version', String(version));
  return api.postForm<ApiResponse<T>>(endpoint, data);
}
