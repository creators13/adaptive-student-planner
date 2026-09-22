Initial goal:
Can upload classes
Can do the example 1600 workflow below

Components:
UI. To-do and calendar.
Upload assignment details, extract relevant info.
Creating a time prediction for assignment based on the relevant info (AI/ML model).
User auth and profiles (username + password thing, all user data is associated with their own account)
Notifications - for end of blocks. User input after scheduled event
Later — system can automatically schedule events
Later — system can learn from user input and adjust scheduling
Import classes 7
Interactive calendar
Push calendar to google calendar


What project do we wanna do: Student planner. Help students manage time better.
What features for MVP? MVP is web app.
UI: Calendar interface. Synch w gcal?
Some way for users to provide inputs:
To-do list section of app. User provides tasks w details, then system can schedule out the tasks. What details?
User can provide time estimate before task, then can provide real duration after the task. System will account for this feedback.
System should request user input to get time duration feedback.
Course details
Course schedule
Syllabus
Allow the user to edit the calendar (drag and drop?)
When a user makes an account, we can ask them for their work preferences
Model needs to be able to schedule different tasks in different ways.
Fixed events: Classes, recurring meetings, etc.
Flexible events: events that can happen at diff times.
Interesting Reads: https://www.microsoft.com/en-us/research/publication/task-duration-estimation/ 



Example user workflow: CIS 1600 pset due Thursday nights.
In the todo list section student enters that there is an assignment due on thursday
Student uploads a pdf of the assignment (?) or “somehow” enters info about the assignment (number of questions, types of questions, etc.)
Student enters an estimate of how long the assignment will take to complete and when they want to finish the assignment by (this could be before the actual deadline)
The system will schedule time between “now” and the deadline to complete the assignment. 
After each work time block the system will ask for progress (number of questions done)
The system can update next time blocks for this assignment according to the progress made

No one is specifically in charge of any specific tasks, if you don’t finish working on something make sure you have your AI clearly save info on what’s been done, and what still needs to be done.
