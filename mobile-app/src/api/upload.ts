import { apiClient, API_BASE_URL } from './client'

// e.g. "http://192.168.31.67:8080/api/v1" → "http://192.168.31.67:8080"
const SERVER_HOST = API_BASE_URL.replace(/\/api\/v\d+.*$/, '')

export async function uploadFile(uri: string, name: string, type: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', { uri, name, type } as any)

  const res = await apiClient.post<{ url: string }>('/upload', formData, {
    transformRequest: (data, headers) => {
      delete headers['Content-Type'] // let axios set multipart/form-data with boundary
      return data
    },
  })

  // Backend returns a relative path like /uploads/abc.jpg
  // Prepend the server host so the image is reachable from the device
  const path = res.data.url
  return path.startsWith('http') ? path : `${SERVER_HOST}${path}`
}
