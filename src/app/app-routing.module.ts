import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { APP_ROUTE } from "./app.routes";

const routes: Routes = APP_ROUTE;

@NgModule({
  // Pages are separate chunks (smaller first load); they are downloaded in the background once the app runs,
  // so opening a page does not wait for its code.
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }), RouterModule],
  exports: [RouterModule]
})

export class AppRoutingModule { }
