import { Injectable } from '@angular/core';
import {Observable, throwError} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {environment} from "@env/environment";

@Injectable({
  providedIn: 'root'
})
export class DocumentService {

  constructor(private http: HttpClient) {}

  private documentUrl=environment.documentServiceUrl;
  private apiUrl=environment.baseApiUrl;

  uploadPublicProfilePhoto(file: File): Observable<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ photoUrl: string }>(`${this.apiUrl}/api/users/me/public-photo`, formData);
  }

  getFilesInFolder(path: string): Observable<string[]> {
    const url = `${this.documentUrl}/files/list`;
    return this.http.get<string[]>(url, { params: { path } });
  }

  simpleUploadPhoto(file: File,directoryUrl:string):Observable<any>
  {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filePath', directoryUrl);
    const uploadUrl = `${this.documentUrl+"/client-photo/upload/path"}`;
    return this.http.post(uploadUrl, formData,{ responseType: 'text' });
  }
  uploadPhoto(file: File, id: string,directoryUrl:string):Observable<any>
  {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filePath', directoryUrl+'/'+id);
    const uploadUrl = `${this.documentUrl+"/client-photo/upload/path"}`;
    return this.http.post(uploadUrl, formData,{ responseType: 'text' });
  }
  getPhoto(id: string,directoryUrl:string): Observable<any> {
    const requestBody = {
      objectPath: `${directoryUrl}/${id}`
    };
    const downloadUrl = `${this.documentUrl}/client-photo/client-photo/generate-url`;
    return this.http.post(downloadUrl, requestBody, { responseType: 'text' });
  }
  simpleGenerateFileUrl(pathToFile:string){
    const getPhototUrl = `${this.documentUrl}/client-photo/client-photo/generate-url`;
    const body = {objectPath:  pathToFile};
    return this.http.post(getPhototUrl, body, {responseType: 'text'});
  }

  refreshStoredFileUrl(storedUrl: string): Observable<string> {
    try {
      const parsed = new URL(storedUrl);
      const segments = parsed.pathname
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment));

      // MinIO URLs contain the bucket first. The document service expects the
      // exact object key, including the generated filename.
      if (segments.length < 2) {
        return throwError(() => new Error('Invalid stored document URL'));
      }

      return this.simpleGenerateFileUrl(segments.slice(1).join('/'));
    } catch (error) {
      return throwError(() => error);
    }
  }
  downloadFile(path: string): Observable<Blob> {
    const downloadUrl = `${this.documentUrl}/files/downloadFile`;
    const body = { objectPath: path };
    return this.http.post(downloadUrl, body, { responseType: 'blob' });
  }
  downloadZip(paths: string[], zipName?: string) {
    const url = `${this.documentUrl}/files/downloadZip`;
    const body = { objectPaths: paths, zipName };
    return this.http.post(url, body, { responseType: 'blob' });
  }

  uploadFileInPath(file: File,path: string): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const url = `${this.documentUrl}/files/upload/in-path`;

    return this.http.post(url, formData, { responseType: 'text' });
  }

  deleteFile(objectPath: string): Observable<void> {
    const url = `${this.documentUrl}/files/delete`;
    return this.http.delete<void>(url, {
      params: { objectPath }
    });
  }

}
