export const isNumber = (text: string) => /^\d+$/.test(text)

export const capitalizeFirstLetterOfEveryWord = (text: string) =>
  text
    .toLowerCase()
    .split(' ')
    .map(s => s.charAt(0).toUpperCase() + s.substring(1))
    .join(' ')
