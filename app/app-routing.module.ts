import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { APP_ROUTE } from "./app.routes";

const routes: Routes = APP_ROUTE;

@NgModule({
  imports: [RouterModule.forRoot(routes),RouterModule],
  exports: [RouterModule]
})

export class AppRoutingModule { }
