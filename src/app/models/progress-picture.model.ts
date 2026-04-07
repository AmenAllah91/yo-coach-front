export interface ProgressPicture {
  id: string;
  imageUrl: string;
  weight: number;
  unit: 'kg' | 'lb';
  date: string;
  coach?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
  client?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveProgressPictureRequest {
  imageUrl: string;
  weight: number;
  unit: 'kg' | 'lb';
  date: string;
  clientId: string;
}
