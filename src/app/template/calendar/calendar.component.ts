import { Component, ViewChild, OnInit, TemplateRef } from '@angular/core';
import {
  CalendarOptions,
  DateSelectArg,
  EventClickArg,
  EventApi,
} from '@fullcalendar/core';

import { EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';

import { UntypedFormBuilder, UntypedFormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Calendar } from './calendar.model';
import { CalendarService } from './calendar.service';
import { INITIAL_EVENTS } from './events-util';
import { formatDate } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { FullCalendarModule } from '@fullcalendar/angular';
import { RouterLink } from '@angular/router';
import { OwlDateTimeModule, OwlNativeDateTimeModule } from '@danielmoncada/angular-datetime-picker';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.sass'],
  providers: [ToastrService],
  standalone: true,
  imports: [
    RouterLink,
    FullCalendarModule,
    FormsModule,
    OwlDateTimeModule,
    OwlNativeDateTimeModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class CalendarComponent implements OnInit {
  @ViewChild('calendar', { static: false })
  calendar: Calendar | null;
  calendarForm: UntypedFormGroup;
  dialogTitle: string;
  filterOptions = 'All';
  calendarData: any;
  isEditClick?: boolean;
  filterItems: string[] = [
    'work',
    'personal',
    'important',
    'travel',
    'friends',
  ];

  calendarEvents!: EventInput[];
  tempEvents?: EventInput[];

  public filters = [
    { name: 'work', value: 'WORK', checked: true },
    { name: 'personal', value: 'PERSONAL', checked: true },
    { name: 'important', value: 'IMPORTANT', checked: true },
    { name: 'travel', value: 'TRAVEL', checked: true },
    { name: 'friends', value: 'FRIENDS', checked: true },
  ];

  @ViewChild('callAPIDialog', { static: false })
  callAPIDialog?: TemplateRef<any>;

  @ViewChild('eventWindow')
  eventWindow?: TemplateRef<any>;
  calCheck: any;

  constructor(
    private fb: UntypedFormBuilder,
    public calendarService: CalendarService,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private translate: TranslateService,
  ) {
    this.dialogTitle = 'Add New Event';
    const blankObject = {} as Calendar;
    this.calendar = new Calendar(blankObject);
    this.calendarForm = this.createCalendarForm(this.calendar);
  }

  public ngOnInit(): void {
    this.calendarEvents = INITIAL_EVENTS;
    this.tempEvents = this.calendarEvents;
    this.calendarOptions.initialEvents = this.calendarEvents;
  }

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
    },
    initialView: 'dayGridMonth',
    weekends: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    select: this.handleDateSelect.bind(this),
    eventClick: this.handleEventClick.bind(this),
    eventsSet: this.handleEvents.bind(this),
  };

  handleDateSelect(selectInfo: DateSelectArg) {
    this.eventWindowCall(selectInfo, 'addEvent');
  }
  eventWindowCall(row: any, type: string) {
    if (type === 'editEvent') {
      this.dialogTitle = row.event.title;
      this.isEditClick = true;
      this.calendarForm.setValue({
        id: row.event.id,
        title: row.event.title,
        category: row.event.groupId,
        startDate: formatDate(row.event.start, 'yyyy-MM-dd', 'en') || '',
        endDate: formatDate(row.event.end, 'yyyy-MM-dd', 'en') || '',
        details: row.event.extendedProps.details,
      });
    } else {
      this.calendarForm.reset();
      this.isEditClick = false;
    }

    this.modalService.open(this.eventWindow, {
      ariaLabelledBy: 'modal-basic-title',
      size: 'lg',
    });
  }

  saveEvent(form: UntypedFormGroup) {
    this.calendarData = form.value;
    this.calendarEvents = this.calendarEvents.concat({
      id: this.randomIDGenerate(5, 'abcdefghijklmnopqrstuvwxyz'),
      title: this.calendarData.title,
      start: this.calendarData.startDate,
      end: this.calendarData.endDate,
      className: this.getClassNameValue(this.calendarData.category),
      groupId: this.calendarData.category,
      details: this.calendarData.details,
    });
    this.calendarOptions.events = this.calendarEvents;
    this.calendarForm.reset();
    this.modalService.dismissAll();

    this.showNotification(
      'success',
      this.translate.instant('EVENT_SAVED_SUCCESSFULLY'),
      'top',
      'right'
    );
  }

  eventClick(form: UntypedFormGroup) {
    this.calendarData = form.value;

    this.calendarEvents.forEach((element, index) => {
      if (this.calendarData.id === element.id) {
        this.saveEditEvent(index, this.calendarData);
      }
    }, this);
  }

  saveEditEvent(eventIndex: number, calendarData: any) {
    const calendarEvents = this.calendarEvents.slice();
    const singleEvent = Object.assign({}, calendarEvents[eventIndex]);
    singleEvent.id = calendarData.id;
    singleEvent.title = calendarData.title;
    singleEvent.start = calendarData.startDate;
    singleEvent.end = calendarData.endDate;
    singleEvent.className = this.getClassNameValue(calendarData.category);
    singleEvent.groupId = calendarData.category;
    singleEvent['details'] = calendarData.details;
    calendarEvents[eventIndex] = singleEvent;
    this.calendarEvents = calendarEvents; // reassign the array

    this.calendarOptions.events = calendarEvents;

    this.calendarForm.reset();
    this.modalService.dismissAll();

    this.showNotification(
      'success',
      this.translate.instant('EVENT_UPDATED_SUCCESSFULLY'),
      'top',
      'right'
    );
  }

  changeCategory(event: any, filter: any) {
    if (event.target.checked) {
      this.filterItems.push(filter.name);
    } else {
      this.filterItems.splice(this.filterItems.indexOf(filter.name), 1);
    }
    this.filterEvent(this.filterItems);
  }

  filterEvent(element: any) {
    const list = this.calendarEvents.filter((x) =>
      element.map((y: any) => y).includes(x.groupId)
    );
    this.calendarOptions.events = list;
  }

  handleEventClick(clickInfo: EventClickArg) {
    this.eventWindowCall(clickInfo, 'editEvent');
  }

  handleEvents(events: EventApi[]) {
    // this.currentEvents = events;
  }

  createCalendarForm(calendar: Calendar): UntypedFormGroup {
    return this.fb.group({
      id: [calendar.id],
      title: [calendar.title, [Validators.required]],
      category: [calendar.category],
      startDate: [calendar.startDate, [Validators.required]],
      endDate: [calendar.endDate, [Validators.required]],
      details: [calendar.details],
    });
  }

  getClassNameValue(category: string) {
    let className = '';

    if (category === 'work') {
      className = 'fc-event-success';
    } else if (category === 'personal') {
      className = 'fc-event-warning';
    } else if (category === 'important') {
      className = 'fc-event-primary';
    } else if (category === 'travel') {
      className = 'fc-event-danger';
    } else if (category === 'friends') {
      className = 'fc-event-info';
    }

    return className;
  }
  public randomIDGenerate(length: number, chars: string) {
    let result = '';
    for (let i = length; i > 0; --i) {
      result += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return result;
  }
  showNotification(
    eventType: string,
    message: string,
    ypos: string,
    xpos: string
  ) {
    if (eventType === 'success') {
      this.toastr.success(message, '', {
        positionClass: 'toast-' + ypos + '-' + xpos,
      });
    }
  }
}
