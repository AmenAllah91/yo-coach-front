import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-invitation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invitation.component.html',
  styleUrls: ['./invitation.component.scss'],
})
export class InvitationComponent implements OnInit {
  coachName  = 'Alexandre Martin';
  inviteLink = 'https://yocoach.app/invite/accept/abc123xyz';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Récupérer les query params si le lien est dynamique
    // ex: /invitation?coach=Alexandre+Martin&token=abc123xyz
    this.route.queryParams.subscribe(params => {
      if (params['coach']) this.coachName  = params['coach'];
      if (params['token']) this.inviteLink = `https://yocoach.app/invite/accept/${params['token']}`;
    });
  }
}
