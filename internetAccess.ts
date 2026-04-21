import { fetchInternetData } from './networking';

export function accessInternet(url: string) {
  return fetchInternetData(url).then(response => response.data);
}