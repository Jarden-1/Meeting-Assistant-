export type CurrentUser = {
  id: string;
  entryName: string;
  displayName: string;
};

export type PageQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
};
