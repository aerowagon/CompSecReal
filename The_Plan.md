Maggie Oct 13th, 2025 : Is this page supposed to just be for planning? 
In my previous projects we always had a page where we would write out our updates.
If this is not what this page is for just delete what I write lol.

Oct 13th push, Maggie J:
- I worked on Log-in page html/css.
- Created student and faculty html pages.
- made css style more themed towards project (UWEC page)
Any styling/theme changes I did can be changed/switched, I just wanted to get stuff up, and I figured since the assignment is geared towards blugolds why not use the already crafted theme our university has.

Oct 14th push, James
- made server.js
-  used nmp to make package-lock.json and package.json
- got server running and have a database on my computer.
- updated login.html to use .js code (will extract later)
- verified info went from login.html to mysql database.

what still need is function to move to page after login
responce indicating something happend.

Oct 15th push, james
- made admin page alowing adding of studetents
    (linked from faculty 'create student' button)
- updated server.js too:
    - push new user to database
    - pull student name from data base to student list in faculty
- updated faculty page with js to allow students in database to be put to list
    (still need to contain size of list)
- updated login page to allow:
    * faculty to log in
    * students to log in
    * give error messeage upon wrong username or password

Oct 16th push, james
- made editStudent.html
    (open from faculty view "student" button)
- can now edit gpa and credits
- link form login to faculty shows personl info from database.

oct 20th push james
- update to student page to show current user.
    (phone number and address do not work. phone number not in database)
- updated server.js faculty, and editStudent to make perniment updates in database gpa and credit, show faculty user name





Promblems need to fix.
- (sec) going back and forward still has you get back to accout
- (sec) password not hashed , encoded or anything else in data base

- database GPA  is an int. (3.5 rounds to 4)
- database credit is an int. ( only recoreds dollars no cents)
- gpa and credit not displayed
- need to update student view. 

    