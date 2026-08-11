import {Component, Input, Output, EventEmitter, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import {InvitationService} from "../../../service/invitation.service";
import {AuthService} from "@config/auth.service";
import {environment} from "@env/environment";

@Component({
  selector: 'app-add-client-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './add-client-modal.component.html',
  styleUrls: ['./add-client-modal.component.scss'],
})
export class AddClientModalComponent implements OnInit{
  @Input() isVisible = false;
  @Output() onClose  = new EventEmitter<void>();
  @Output() onCreate = new EventEmitter<{ email: string }>();
  currentCoachId = this.authService.getId() || '';
  email      = '';
  copied     = false;
  inviteLink = environment.apiUrl + '/invitation/';
  invitationToken?: string;
  invitationUsed = false;

  constructor(private inviteService: InvitationService,
              private authService: AuthService,
              private invitationService: InvitationService) {
  }

  async ngOnInit() {
    this.currentCoachId = (await this.authService.getId()) || '';
    this.inviteService.generateInvitation({
      email: this.email,
      idCoach: this.currentCoachId
    }).subscribe(inv => {
      this.invitationToken = inv.invitationLink;
      this.inviteLink = this.inviteLink + this.invitationToken;
    });
  }
  closeModal(): void {
    if (!this.invitationUsed && this.invitationToken) {
      this.inviteService
        .deleteInvitationByToken(this.invitationToken)
        .subscribe({
          error: () => {}
        });
    }

    this.email = '';
    this.copied = false;
    this.invitationUsed = false;
    this.invitationToken = undefined;
    this.onClose.emit();
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.inviteLink).catch(() => {});
    this.copied = true;
    this.invitationUsed = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  sendInvitation(): void {
    if (!this.email.trim()) return;
    this.invitationUsed = true;
    const userId = sessionStorage.getItem('userId');
    this.invitationService.sendInvitation(this.invitationToken, userId, this.email)
      .subscribe();
    this.onCreate.emit({ email: this.email.trim() });
    this.closeModal();
  }
}
