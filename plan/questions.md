# Open planning questions

Status: Proposed

Purpose: identify the choices students need to make before committing to scope,
technology, or a delivery schedule. These questions do not select an approach.

1. **Users and problem:** Who is the initial user, and which planning problem
   should the first version address?
2. **First working version:** What small end-to-end workflow should it demonstrate?
   What are its acceptance criteria, and what is explicitly out of scope?
3. **Constraints:** Which course deadlines, budget limits, access requirements,
   and team skills must shape the implementation?
4. **Stack and architecture:** Which tools and components are needed for that
   first version, and what alternatives and tradeoffs justify the choice? The frontend is
   proposed as React and TypeScript
   ([decision 0001](../docs/decisions/0001-frontend-react-typescript.md), settled with the
   `hxu/ui-first-pass` pull request); the backend, data storage, hosting, and architecture
   are still open.
5. **Data and evaluation:** What data can be collected with consent, and what
   evidence would demonstrate usefulness? Which baselines and measures fit the
   agreed scope?
6. **Ownership and sequence:** Who owns each initial task, which tasks depend on
   others, and what delivery targets can the students commit to?
7. **Verification and operation:** What checks and development environment are
   needed for the first version? Review the [proposed testing concerns](testing.md)
   once scope is clear. The web app's checks exist (`scripts/check.sh`); the backend's and
   any CI setup are still open.
8. **Scheduling preferences:** What data must the planner collect from a student
   to know when a floating task is suitably placed (for example, preferred
   working hours, cut-off times, or session lengths)?
9. **Placement strategy:** Should the planner front-load floating work into the
   nearest free time (finishes early, leaves slack if something slips) or spread
   it out as evenly as possible before the deadline (lighter days, but delays push
   work toward the deadline)? Should this be a student preference, for example a
   slider between the two? A related choice: when a floating session is moved
   aside by an overlap, should it be re-placed as close as possible to its old
   time (such as right after the conflict, or split around it) instead of being
   placed from scratch? Today the prototype places from scratch: earliest day
   first, one session per day, peak-energy hours within a day (see the fit-check
   rule in [user-flows.md](uiux/user-flows.md#rule-reference)).
10. **Per-task scheduling inputs:** Which scheduling preferences can a student
    override on a single task, with their general preferences as the default?
    Candidates include session length (preferred, shortest, longest) and the
    placement strategy from question 9 (front-load or spread out). Today only a
    task's time of day and whether it can be split are set per task.

Record answers in [decision records](../docs/decisions/) or focused plans with
their human owners and explicit approval evidence. Keep unresolved choices open;
update [active work](active.md) with only the next authorized steps.
