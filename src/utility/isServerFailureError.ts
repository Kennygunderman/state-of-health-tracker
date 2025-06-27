import axios from 'axios'

export function isServerFailureError(err: unknown): boolean {
  return axios.isAxiosError(err) && !!err.response?.status
}
