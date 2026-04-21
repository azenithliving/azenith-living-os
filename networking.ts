import axios from 'axios';
import https from 'https';
import http from 'http';

const instance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  httpAgent: new http.Agent({
    rejectUnauthorized: false
  })
});

export function fetchInternetData(url: string) {
  return instance.get(url);
}