/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MealsService } from 'app/service/meals.service';
import { AddMealModalComponent } from './add-meal-modal.component';

@Component({
  selector: 'app-meal-editor',
  standalone: true,
  imports: [CommonModule, AddMealModalComponent],
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
        this.loadError = 'The meal could not be loaded.';
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
