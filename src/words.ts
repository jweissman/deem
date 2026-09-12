export default class Words {
  static ordinal(nth: number): string {
    const j = nth % 10,
          k = nth % 100;
    if (j === 1 && k !== 11) {
      return nth + "st";
    }
    if (j === 2 && k !== 12) {
      return nth + "nd";
    }
    if (j === 3 && k !== 13) {
      return nth + "rd";
    }
    return nth + "th";
  }

  static humanize(phrase: string) {
    return String(phrase).replace(/([A-Z])/g, ' $1') // Add space before capital letters
                  .replace(/[_-]+/g, ' ')    // Replace underscores and hyphens with spaces
                  .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
                  .toLowerCase()             // Convert to lowercase
                  .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize first letter of each word
                  .trim();                   // Trim leading/trailing spaces
  }

  static a_an(phrase: string): string {
    const firstLetter = phrase.trim().charAt(0).toLowerCase();
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    const article = vowels.includes(firstLetter) ? 'an' : 'a';
    return `${article} ${phrase}`;
  }
  static capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  static humanizeList = (arr: string[]): string => {
    if (arr.length === 0) {return '';}
    if (arr.length === 1) {return arr[0] ?? '';}
    if (arr.length === 2) {return `${arr[0] ?? ''} and ${arr[1] ?? ''}`;}
    const last = arr[arr.length - 1] ?? '';
    return `${arr.slice(0, -1).join(', ')}, and ${last}`;
  }

  static remove_article(phrase: string): string {
    return phrase.replace(/^(a|an|the)\s+/i, '');
  }

  static humanizeNumber(num: number): string {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (num >= 1_000) {
      return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    } else {
      return num.toString();
    }
  }
}