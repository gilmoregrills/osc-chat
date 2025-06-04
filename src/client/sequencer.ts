class GridItem {
  public position: string;
  public isActive: boolean;
  public isHighlighted: boolean;

  constructor(position: string, isActive: boolean) {
    this.position = position;
    this.isActive = isActive;
    this.isHighlighted = false;
  }

  public toggleActive(): void {
    this.isActive = !this.isActive;
  }

  public generateInnerHTML(): string {
    const character = this.isActive ? "x" : ".";
    return `
      <p>${character}</p>
    `;
  }

  public render(): void {
    const div = document.getElementById(this.position) as HTMLDivElement | null;
    if (div) {
      div.innerHTML = this.generateInnerHTML();
    } else {
      console.error(`GridItem div with ID '${this.position}' not found.`);
    }
  }

  public initialise(rowElement: HTMLDivElement): void {
    const div = document.createElement("div");
    div.id = this.position;
    div.className = "seqItem"; // Use className
    div.innerHTML = this.generateInnerHTML();
    div.addEventListener("click", (e: MouseEvent) => {
      this.handleClick(e);
    });
    rowElement.appendChild(div);
  }

  private handleClick(e: MouseEvent): void {
    this.toggleActive();
    this.render();
  }
}

const makeGrid = (): GridItem[][] => {
  const rows: GridItem[][] = [];

  for (let i = 0; i < 4; i++) {
    const row: GridItem[] = [];
    // No need for separate x, y variables if only used for string construction
    for (let j = 0; j < 8; j++) {
      row.push(new GridItem(`${i}${j}`, false));
    }
    rows.push(row);
  }
  return rows;
};

const getRandomInt = (min: number, max: number): number => {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
};

const generateMessageStringForInputFields = (): string => {
  const channel = getRandomInt(1, 3); // Assuming channel 1 or 2 (3 is exclusive max)
  const pitch = getRandomInt(1, 13);  // Assuming pitch 1-12
  const octave = getRandomInt(1, 8);  // Assuming octave 1-7
  const length = 8; // Fixed length
  return `${channel} ${pitch} ${octave} ${length}`;
};

export const makeSequencer = (): GridItem[][] => {
  const grid: GridItem[][] = makeGrid();
  const exampleMessages: string[] = [];
  for (let i = 0; i < grid.length; i++) {
    exampleMessages.push(generateMessageStringForInputFields());
  }
  const sequencerDiv = document.getElementById("sequencer") as HTMLDivElement | null;

  if (!sequencerDiv) {
    console.error("Sequencer container div with ID 'sequencer' not found.");
    return grid; // Return grid, though setup failed
  }

  grid.forEach((rowItems: GridItem[], rowIndex: number) => {
    const seqRowDiv = document.createElement("div");
    seqRowDiv.id = `sequencer-row-${rowIndex}`; // Make ID more unique
    seqRowDiv.className = "sequencer-row";

    rowItems.forEach((item: GridItem) => {
      item.initialise(seqRowDiv);
    });

    const msgField = document.createElement("input");
    msgField.type = "text";
    msgField.value = exampleMessages[rowIndex];
    msgField.id = `sequencer-message-field-${rowIndex}`;
    seqRowDiv.appendChild(msgField);
    sequencerDiv.appendChild(seqRowDiv);
  });
  return grid;
};
