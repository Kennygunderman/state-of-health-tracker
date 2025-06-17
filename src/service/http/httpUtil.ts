import { AxiosRequestConfig } from "axios";
import * as io from 'io-ts'
import httpRequest from "./httpRequest";

export function httpGet<T>(
  url: string,
  decoder: io.Type<T>,
  config?: AxiosRequestConfig
): Promise<T | null> {
  return httpRequest('GET', url, decoder, config, {})
}
