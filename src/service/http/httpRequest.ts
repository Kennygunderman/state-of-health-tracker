import axios, { AxiosRequestConfig, Method } from 'axios'
import * as io from 'io-ts'
import { isLeft } from 'fp-ts/lib/Either'
import CrashUtility from "../../utility/CrashUtility";

export interface HttpResponse<T> {
  data: T;
  status: number;
}

async function httpRequest<T>(
  method: Method,
  url: string,
  decoder: io.Type<T>,
  config: AxiosRequestConfig = {},
  body?: any
): Promise<HttpResponse<T>> {
  const axiosConfig: AxiosRequestConfig = {
    method,
    url,
    ...config,
  }

  if (method !== 'GET') {
    axiosConfig.data = body ?? {}
  }

  const response = await axios.request(axiosConfig)

  const decoded = decoder.decode(response.data)

  if (isLeft(decoded)) {
    const error = Error(`Decoding failed for ${method} ${url}: ${JSON.stringify(decoded.left)}`)
    CrashUtility.recordError(error)
    throw error
  }

  return {
    data: decoded.right,
    status: response.status,
  }
}

export default httpRequest;
