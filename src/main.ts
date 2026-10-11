import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { DiaryComponent } from './app/diary.component';
import { authInterceptor } from './auth.interceptor';

bootstrapApplication(DiaryComponent, {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))],
}).catch(console.error);
