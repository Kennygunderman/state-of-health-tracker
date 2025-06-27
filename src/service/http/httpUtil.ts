import * as io from 'io-ts'

import httpRequest, {HttpRequestOptions, HttpResponse} from './httpRequest'

export function httpGet<T>(
  url: string,
  decoder: io.Type<T>,
  options?: HttpRequestOptions
): Promise<HttpResponse<T> | null> {
  return httpRequest('GET', url, decoder, options, {})
}

export function httpDelete<T>(
  url: string,
  decoder: io.Type<T>,
  options?: HttpRequestOptions
): Promise<HttpResponse<T> | null> {
  return httpRequest('DELETE', url, decoder, options, {})
}

export function httpPost<T>(
  url: string,
  decoder: io.Type<T>,
  body?: any,
  options?: HttpRequestOptions
): Promise<HttpResponse<T> | null> {
  return httpRequest('POST', url, decoder, options, body)
}

export function httpPut<T>(
  url: string,
  decoder: io.Type<T>,
  body?: any,
  options?: HttpRequestOptions
): Promise<HttpResponse<T> | null> {
  return httpRequest('PUT', url, decoder, options, body)
}
