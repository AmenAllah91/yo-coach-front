import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Conversation } from "../models/conversation";
import { NgClass, NgForOf, NgIf } from "@angular/common";
import { ChatService } from "../../../service/chat.service";
import { FormsModule } from "@angular/forms";
import { FeatherModule } from "angular-feather";
import { forkJoin, Observable, of, switchMap } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { TranslateModule } from "@ngx-translate/core";
import { UsersService } from "../../../service/users.service";

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    FormsModule,
    FeatherModule,
    NgClass,
    TranslateModule
  ],
  templateUrl: './conversation-list.component.html',
  styleUrl: './conversation-list.component.scss'
})
export class ConversationListComponent implements OnInit {

  @Output() conversationSelected = new EventEmitter<Conversation>();
  @Output() closed = new EventEmitter<void>();

  conversations: Conversation[] = [];
  userSuggestions: any[] = [];
  searchUser = '';
  searchConversation = '';
  mode: 'LIST' | 'ADD' = 'LIST';

  constructor(
    private chatService: ChatService,
    private userService: UsersService
  ) {}

  ngOnInit(): void {
    this.loadConversations();
  }


  loadConversations() {
    this.chatService.getConversations().subscribe({
      next: (pageDto) => {

        const observables = pageDto.content.map(conv =>
          this.enrichConversation(conv)
        );

        forkJoin(observables).subscribe(finalConvs => {
          this.conversations = finalConvs;
        });
      },
      error: err => console.error(err)
    });
  }


  select(conv: Conversation) {
    this.conversationSelected.emit(conv);
  }

  switchToAdd() {
    this.mode = 'ADD';
    this.loadUserSuggestions();
  }

  switchToList() {
    this.mode = 'LIST';
    this.searchUser = '';
    this.loadConversations();
  }

  loadUserSuggestions() {
    this.userService.getUsersSuggestions().subscribe({
      next: res => this.userSuggestions = res.content,
      error: err => console.error(err)
    });
  }

  searchUsers() {
    if (this.searchUser.length < 2) {
      this.loadUserSuggestions();
      return;
    }

    this.userService.searchUsers(this.searchUser).subscribe({
      next: res => this.userSuggestions = res.content,
      error: err => console.error(err)
    });
  }


  createConversationWith(user: any) {

    const request = {
      coachId: sessionStorage.getItem('userId'),
      clientId: user.id
    };

    this.chatService.createConversation(request).pipe(
      switchMap((conv: Conversation) => this.enrichConversation(conv))
    ).subscribe(convEnriched => {

      this.conversations = [convEnriched, ...this.conversations];
      this.switchToList();
      this.select(convEnriched);

    });
  }

  private enrichConversation(conv: Conversation): Observable<Conversation> {
    if (conv.isGroup) return of(conv);

    const currentUserId = sessionStorage.getItem('userId');
    let otherUserId;
    if (currentUserId === conv.clientId){
      otherUserId = conv.coachId;
    }
    else if (currentUserId === conv.coachId) {
      otherUserId = conv.clientId;
    }
    if (!otherUserId) return of(conv);

    return this.userService.getUserById(otherUserId).pipe(
      map(user => {
        conv.name = user.firstName + " " + user.lastName;
        if(user.avatarUrl === 'not found')
          conv.avatar = null
        else
          conv.avatar = user.avatarUrl;
        return conv;
      }),
      catchError(() => of(conv))
    );
  }


  onSearchConversation() {
    const value = this.searchConversation.toLowerCase();
    this.conversations = this.conversations.filter(c =>
      c.name?.toLowerCase().includes(value)
    );
  }

  closeChat() {
    this.closed.emit();
  }

}
