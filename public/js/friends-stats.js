/* This file contains the logic for the buttons generated on the see friend stats page. */

/*
 *  Logic for the compare stats button on click.
 *  When the compare stats button is clicked we must:
 *      1. Get the ID of the friend we want to compare stats with.
 *      2. Redirect to the compare stats page.
 */
async function compareStatsButtonOnClick(event) {
    /* 1. Get the ID of the friend we want to compare stats with. */
    const clickedButton = event.target;
    const friendID = parseInt(clickedButton.getAttribute('data-friend-id'));

    /* 2. Redirect to the compare stats page. */
    if (!friendID) {
        alert("please try again")
    } else {
        const response = await fetch('/compare', {
            method: 'POST',
            body: JSON.stringify({ friend: friendID }),
            headers: { 'Content-Type': 'application/json' },
        });
        console.log(response)
        if (response.ok) {
            const response = await fetch('/compare/sharedGames', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                window.location.replace('/compare/sharedGames')
                // alert("am i the working?")
            }
        } else {
 
            alert('Search failed! Twy again UwU');
        }
    }
}

/*
 *  Logic for the owned game button on click.
 *  When the owned game button is clicked we must:
 *      1. Get the button element was clicked as the event is delegated.
 *      2. Get the appid of the button that was clicked.
 *      3. Get the friend ID of the friend whose stats we are viewing.
 *      4. Redirect the user to the stats page.
 */
function ownedGameButtonOnClick(event) {
    /* 1. Get the button element was clicked as the event is delegated. */
    const clickedElement = event.target;
    let button;

    if (!clickedElement.matches("button")) {
        button = clickedElement.closest('button');
    } else {
        button = clickedElement;
    }

    /* 2. Get the appid of the button that was clicked. */
    const appid = parseInt(button.getAttribute('ownedgameappid'));

    /* 3. Get the friend ID of the friend whose stats we are viewing. */
    const friendID = parseInt(document.location.pathname.match(/\d+/g));

    const gameName = button.querySelector("div > p").innerHTML;
    
    /* 4. Redirect the user to the stats page. */
    document.location.replace(`/friends/${friendID}/stats/${appid}?name=${gameName}`);
}

$('.ownedGameBtn').on('click', ownedGameButtonOnClick);
$('#compare-stats-button').on('click', compareStatsButtonOnClick);