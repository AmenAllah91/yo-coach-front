import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { DocumentService } from 'app/service/document.service';
import { ProgressPicture, ProgressPicturesService } from 'app/service/progress-pictures.service';

/** Folder of each client's pictures in the document service. */
export const PROGRESS_PICTURES_DIRECTORY = 'client-progress-pictures';

/** Last pictures of each client (with their signed links, valid a few hours): shown at once on the next visit. */
const PICTURES_SNAPSHOT = new Map<string, { at: number; pictures: ProgressPicture[] }>();

/** Pictures already read for this client in the last 10 minutes (signed links still valid), newest first. */
export function cachedClientPictures(clientId: string): ProgressPicture[] | null {
  const known = PICTURES_SNAPSHOT.get(clientId);
  return known && Date.now() - known.at < 10 * 60_000 ? known.pictures : null;
}

/** Any snapshot, even older (only to know there is something to show while reading again). */
export function hasClientPicturesSnapshot(clientId: string): boolean {
  return PICTURES_SNAPSHOT.has(clientId);
}

/**
 * The client's pictures, newest first, with fresh signed links: the pictures and the links of their folder
 * are read at the same time. Shared by the Progress pictures tab and the profile dashboard.
 */
export function loadClientPictures(
  pictures: ProgressPicturesService,
  documents: DocumentService,
  clientId: string,
): Observable<ProgressPicture[]> {
  const folderPath = `${PROGRESS_PICTURES_DIRECTORY}/${clientId}`;
  return forkJoin({
    pictures: pictures.getProgressPicturesByClient(clientId, true),
    freshUrls: documents.getFilesInFolder(folderPath, true).pipe(
      catchError((err) => {
        console.error('getFilesInFolder failed:', err);
        return of([] as string[]);
      }),
    ),
  }).pipe(
    map(({ pictures: items, freshUrls }) => {
      const sorted = (items ?? []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (!sorted.length || !freshUrls?.length) return sorted;
      return sorted.map((picture) => {
        const currentFileName = pictureFileName(picture.imageUrl);
        const freshUrl = freshUrls.find((url) => !!currentFileName && currentFileName === pictureFileName(url));
        return { ...picture, imageUrl: freshUrl || picture.imageUrl };
      });
    }),
    tap((items) => PICTURES_SNAPSHOT.set(clientId, { at: Date.now(), pictures: items })),
  );
}

export function pictureFileName(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  const parts = pathOrUrl.split('?')[0].split('/');
  const fileName = parts.length ? parts[parts.length - 1] : '';
  try {
    return decodeURIComponent(fileName).toLowerCase();
  } catch {
    return fileName.toLowerCase();
  }
}
