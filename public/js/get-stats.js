const getOwnedGameStats = async (event) => {
    event.preventDefault();

    let button;
    let clickedElement = event.target;

    if (!clickedElement.matches("button")) {
        button = clickedElement.closest('button');
    } else {
        button = clickedElement;
    }

    const appId = button.getAttribute("ownedGameAppId");
    
    const gameName = button.querySelector("div > p").innerHTML;

    document.location.replace(`/user-stats/ownedGameStats/${appId}?name=${gameName}`);
};

$(".ownedGameBtn").on("click", getOwnedGameStats)