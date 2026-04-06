// Xtream Codes API Client

export interface XtreamUserInfo {
  username: string;
  password: string;
  message: string;
  auth: number;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

export interface XtreamServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: string;
  rtmp_port: string;
  timezone: string;
  timestamp_now: number;
  time_now: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamStreamItem {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface XtreamVODItem {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface XtreamSeriesItem {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  category_id: string;
}

export interface XtreamEpisodeItem {
  id: number;
  episode_num: number;
  title: string;
  container_extension: string;
  info: {
    duration_secs: number;
    duration: string;
    bitrate: number;
  };
  url: string;
}

export interface XtreamSeasonInfo {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  season_number: number;
  cover: string;
}

export interface XtreamSeriesInfo {
  seasons: XtreamSeasonInfo[];
  info: {
    name: string;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releaseDate: string;
    rating: string;
  };
  episodes: Record<string, XtreamEpisodeItem[]>;
}

export class XtreamClient {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(baseUrl: string, username: string, password: string) {
    // Ensure no trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.username = username;
    this.password = password;
  }

  private buildUrl(action: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.baseUrl}/player_api.php`);
    url.searchParams.set('username', this.username);
    url.searchParams.set('password', this.password);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (action) url.searchParams.set('action', action);
    return url.toString();
  }

  private async fetchApi<T>(action: string, params: Record<string, string> = {}): Promise<T> {
    const url = this.buildUrl(action, params);
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`Xtream API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data as T;
  }

  // Authentication & User Info
  async authenticate(): Promise<XtreamUserInfo> {
    return this.fetchApi<XtreamUserInfo>('');
  }

  // Server Info
  async getServerInfo(): Promise<XtreamServerInfo> {
    return this.fetchApi<XtreamServerInfo>('get_server_info');
  }

  // Live TV Categories
  async getLiveCategories(): Promise<XtreamCategory[]> {
    return this.fetchApi<XtreamCategory[]>('get_live_categories');
  }

  // Live TV Streams
  async getLiveStreams(categoryId?: string): Promise<XtreamStreamItem[]> {
    const params: Record<string, string> = {};
    if (categoryId) params.category_id = categoryId;
    return this.fetchApi<XtreamStreamItem[]>('get_live_streams', params);
  }

  // VOD Categories
  async getVodCategories(): Promise<XtreamCategory[]> {
    return this.fetchApi<XtreamCategory[]>('get_vod_categories');
  }

  // VOD Streams
  async getVodStreams(categoryId?: string): Promise<XtreamVODItem[]> {
    const params: Record<string, string> = {};
    if (categoryId) params.category_id = categoryId;
    return this.fetchApi<XtreamVODItem[]>('get_vod_streams', params);
  }

  // Series Categories
  async getSeriesCategories(): Promise<XtreamCategory[]> {
    return this.fetchApi<XtreamCategory[]>('get_series_categories');
  }

  // Series List
  async getSeriesList(categoryId?: string): Promise<XtreamSeriesItem[]> {
    const params: Record<string, string> = {};
    if (categoryId) params.category_id = categoryId;
    return this.fetchApi<XtreamSeriesItem[]>('get_series', params);
  }

  // Series Info (with seasons and episodes)
  async getSeriesInfo(seriesId: string): Promise<XtreamSeriesInfo> {
    return this.fetchApi<XtreamSeriesInfo>('get_series_info', { series_id: seriesId });
  }

  // Stream URLs
  getLiveStreamUrl(streamId: string, ext: string = 'ts'): string {
    return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.${ext}`;
  }

  getVodStreamUrl(streamId: string, ext: string = 'mp4'): string {
    return `${this.baseUrl}/movie/${this.username}/${this.password}/${streamId}.${ext}`;
  }

  getSeriesStreamUrl(streamId: string, ext: string = 'mp4'): string {
    return `${this.baseUrl}/series/${this.username}/${this.password}/${streamId}.${ext}`;
  }

  // EPG
  async getEpg(streamId: string, limit?: number): Promise<unknown> {
    const params: Record<string, string> = { stream_id: streamId };
    if (limit) params.limit = String(limit);
    return this.fetchApi('get_simple_data_table', params);
  }
}
