import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CoachSettingsService } from 'app/service/coach-settings.service';

export type ProgressPose = 'FRONT' | 'SIDE' | 'BACK';
export interface AddProgressPicturePayload {
  files: Record<ProgressPose, File>;
  weight: number;
  date: string;
  note: string;
}
@Component({selector:'app-add-progress-picture-modal',standalone:true,imports:[CommonModule,FormsModule,TranslateModule],templateUrl:'./add-progress-picture-modal.component.html',styleUrls:['./add-progress-picture-modal.component.scss']})
export class AddProgressPictureModalComponent implements OnChanges {
 @Input() isOpen=false; @Input() saving=false; @Input() error:string|null=null;
 @Output() close=new EventEmitter<void>(); @Output() save=new EventEmitter<AddProgressPicturePayload>();
 readonly poses:ProgressPose[]=['FRONT','SIDE','BACK']; activePose:ProgressPose='FRONT';
 files:Partial<Record<ProgressPose,File>>={}; previews:Partial<Record<ProgressPose,string|ArrayBuffer|null>>={}; fileErrors:Partial<Record<ProgressPose,boolean>>={};
 weight:number|null=null; note=''; date=this.today();
 constructor(private coachSettingsService:CoachSettingsService){}
 get weightUnitLabel(){return this.coachSettingsService.getWeightUnit();}
 ngOnChanges(c:SimpleChanges){if(c['isOpen']?.currentValue)this.reset();}
 private today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
 private reset(){this.files={};this.previews={};this.fileErrors={};this.activePose='FRONT';this.weight=null;this.note='';this.date=this.today();}
 onFileSelected(pose:ProgressPose,event:Event){this.select(pose,(event.target as HTMLInputElement).files?.[0]??null);}
 private select(pose:ProgressPose,file:File|null){if(this.saving||!file)return; const bad=!['image/jpeg','image/png'].includes(file.type)||file.size>10*1024*1024; this.fileErrors[pose]=bad; if(bad){delete this.files[pose];delete this.previews[pose];return;} this.files[pose]=file; const r=new FileReader();r.onload=()=>{if(this.files[pose]===file)this.previews[pose]=r.result};r.readAsDataURL(file);}
 remove(pose:ProgressPose){if(this.saving)return;delete this.files[pose];delete this.previews[pose];delete this.fileErrors[pose];}
 isFormValid(){return this.poses.every(p=>!!this.files[p])&&!!this.weight&&Number.isFinite(this.weight)&&this.weight>0&&!!this.date;}
 submit(){if(this.saving||!this.isFormValid()||this.weight==null)return;this.save.emit({files:this.files as Record<ProgressPose,File>,weight:this.weight,date:this.date,note:this.note.trim()});}
 onClose(){if(!this.saving)this.close.emit();}
}