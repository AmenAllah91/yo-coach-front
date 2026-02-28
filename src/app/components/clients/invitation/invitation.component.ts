import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { InvitationService } from "../../../service/invitation.service";

interface InvitationView {
  coachName: string;
  gymName: string;
  status: string;
}

@Component({
  selector: 'app-invitation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invitation.component.html',
  styleUrls: ['./invitation.component.scss'],
})
export class InvitationComponent implements OnInit {

  token!: string;

  invitation?: InvitationView;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invitationService: InvitationService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token')!;

    if (!this.token) {
      this.router.navigate(['/']);
      return;
    }

    this.loadInvitation();
  }

  loadInvitation() {
    this.invitationService.getInvitationByToken(this.token)
      .subscribe({
        next: (invitation) => {
          if (!invitation) {
            this.router.navigate(['/']);
            return;
          }

          this.invitation = invitation;
          this.loading = false;
        },
        error: () => {
          this.router.navigate(['/']);
        }
      });
  }

  acceptInvitation() {
    const userId = sessionStorage.getItem('userId');

    if (!userId || !this.invitation) {
      this.router.navigate(['/']);
      return;
    }

    this.invitationService.acceptInvitation(this.token, userId)
      .subscribe(() => {
        this.invitation!.status = 'ACCEPTED';
        setTimeout(() => this.router.navigate(['/']), 1000);
      });
  }
}
