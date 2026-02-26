export interface Photo {
  id: string;
  url: string;
  filename: string;
  year: string;
  location: string;
  filmStock: string;
  devDate: string;
  width: number;
  height: number;
  orientation: "landscape" | "portrait" | "square";
  aspectRatio: number;
  hidden: boolean;
}

export interface Filters {
  years: string[];
  locations: string[];
  filmStocks: string[];
}
