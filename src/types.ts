export type SuperWingsLocation = {
  id: string;
  nameZh: string;
  nameEn?: string;
  countryZh: string;
  region: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  episode: {
    season?: number;
    episode?: number;
    titleZh: string;
    summaryZh: string;
    watchUrl?: string;
  };
  tags: string[];
  funFactZh: string;
};
