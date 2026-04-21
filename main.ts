import { accessInternet } from './internetAccess';

export function main() {
  const url = 'https://www.example.com';
  accessInternet(url).then(data => console.log(data));
}