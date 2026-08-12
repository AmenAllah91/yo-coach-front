/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MealsService } from 'app/service/meals.service';
import { AddMealModalComponent } from './add-meal-modal.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-meal-editor',
  standalone: true,
  imports: [CommonModule, AddMealModalComponent, TranslateModule],
  templateUrl: './meal-editor.component.html',
  styleUrls: ['./meal-editor.component.scss'],
})
export class MealEditorComponent implements OnInit {
  meal: any | null = null;
  modalVisible = false;
  loading = false;
  loadError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mealsService: MealsService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.modalVisible = true;
      return;
    }

    this.loading = true;
    this.mealsService.getMeal(id).subscribe({
      next: (meal: any) => {
        this.meal = meal;
        this.loading = false;
        this.modalVisible = true;
      },
      error: () => {
        this.loading = false;
        this.loadError = 'MEAL_LOAD_ERROR';
      },
    });
  }

  close(): void {
    this.modalVisible = false;
    this.router.navigate(['/nutrition/meals']);
  }

  saved(): void {
    this.router.navigate(['/nutrition/meals']);
  }
}
