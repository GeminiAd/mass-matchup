const randomNumbers = [];
// const randomNumbers = [Math.floor(Math.random() * (96) + 2), Math.floor(Math.random() * (96) + 2), Math.floor(Math.random() * (96) + 2)]
// const sortedRandomNumbers = randomNumbers.sort((a, b) => (a - b));

randomNumbers.push(Math.floor(Math.random() * (97) + 2));
let isMoreThanTwoAwayFromAnyInteger;

/* Get three random integers that are greater than 1, less than 99, and the difference between each integer is greater than 2. */
while ((randomNumbers.length < 3)) {
    isMoreThanTwoAwayFromAnyInteger = true;
    const randomNumber = Math.floor(Math.random() * (97) + 2);
    for (let i = 0; i < randomNumbers.length; i++) {
        if (Math.abs(randomNumbers[i] - randomNumber) < 3) {
            isMoreThanTwoAwayFromAnyInteger = false;
        }
    }

    if (isMoreThanTwoAwayFromAnyInteger) {
        randomNumbers.push(randomNumber);
    }
}

const sortedRandomNumbers = randomNumbers.sort((a, b) => (a - b));

// console.log(sortedRandomNumbers);

const styleTag = document.getElementsByTagName('style')[0];
styleTag.innerHTML = `@keyframes flicker {

    0%,
    ${sortedRandomNumbers[0] - 1}%,
    ${sortedRandomNumbers[0] + 1}%,
    ${sortedRandomNumbers[1] - 1}%,
    ${sortedRandomNumbers[1] + 1}%,
    ${sortedRandomNumbers[2] - 1}%,
    ${sortedRandomNumbers[2] + 1}%,
    100% {

        text-shadow:
            0 0 7px #fff,
            0 0 10px #fff,
            0 0 21px #fff,
            0 0 42px var(--neon-blue),
            0 0 82px var(--neon-blue),
            0 0 92px var(--neon-blue),
            0 0 102px var(--neon-blue),
            0 0 151px var(--neon-blue);

    }

    ${sortedRandomNumbers[0]}%,
    ${sortedRandomNumbers[1]}%,
    ${sortedRandomNumbers[2]}% {
        text-shadow: none;
    }
}`;