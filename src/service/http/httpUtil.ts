import { AxiosRequestConfig } from "axios";
import * as io from 'io-ts'
import httpRequest, { HttpResponse } from "./httpRequest";

export function httpGet<T>(
  url: string,
  decoder: io.Type<T>,
  config?: AxiosRequestConfig
): Promise<HttpResponse<T>  | null> {
  return httpRequest('GET', url, decoder, config, {})
}

export function httpPost<T>(
  url: string,
  decoder: io.Type<T>,
  config?: AxiosRequestConfig,
  body?: any
): Promise<HttpResponse<T>  | null> {
  return httpRequest('POST', url, decoder, config, body)
}

