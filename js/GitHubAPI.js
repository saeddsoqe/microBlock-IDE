
let downloadRepoFromGitHubStoreInFS = async (url, storePath, onError) => {
    if (!onError) onError = () => "";

    let gitRepoBase = /\/\/.+\/([^\/]+\/[^\/]+)\/?/gm.exec(url)[1];
    let repoTree = await fetch(`https://api.github.com/repos/${gitRepoBase}/git/trees/master?recursive=1`);
    if (!repoTree.ok) {
        return false;
    }
    repoTree = await repoTree.json();
    for (const object of repoTree.tree) {
        if (object.type === "blob") {
            if (object.size < 500 * 1023) { // Limit max file size 500kB
                await downloadFile(`https://api.github.com/repos/${gitRepoBase}/contents/${object.path}`, `${storePath}/${object.path}`);
            } else {
                onError(object.path + " over 500kB");
            }
        }
    }

    return true;
}

let downloadFile = async (url, saveAs) => {
    let fileDownload = await fetch(url, {
        redirect: "follow",
        headers: { 
            "Accept": (saveAs.endsWith(".png") || saveAs.endsWith(".jpg")) ? "application/vnd.github.v3+json" : "application/vnd.github.v3.raw" 
        },
    });
    if (!fileDownload.ok) {
        onError(url + " download fail");
        return false;
    }
    // console.log(fileDownload);
    if (fileDownload.headers.get("Content-Type").indexOf("application/json") >= 0) {
        let content = await fileDownload.json();
        content = content.content;
        if (saveAs.endsWith(".png") || saveAs.endsWith(".jpg")) {
            let imageType = saveAs.endsWith(".png") ? "png" : saveAs.endsWith(".jpg") ? "jpg" : "";
            fs.write(saveAs, "data:image/" + imageType + ";base64," + content);
        } else {
            fs.write(saveAs, Base64.decode(content));
        }
    } else {
        if (saveAs.endsWith(".png") || saveAs.endsWith(".jpg")) {
            let imageType = saveAs.endsWith(".png") ? "png" : saveAs.endsWith(".jpg") ? "jpg" : "";
            let uint8_content = new Uint8Array(await fileDownload.arrayBuffer());
            console.log(uint8_content);
            fs.write(saveAs, "data:image/" + imageType + ";base64," + btoa(String.fromCharCode.apply(null, uint8_content)));
        } else {
            fs.write(saveAs, await fileDownload.text());
        }
    }

    return true;
}

// GitHub
const github_client_id = "5fd432a542e37673decb";

$("#github-signin").click(() => {
    window.location.href = `https://github.com/login/oauth/authorize?scope=user:email&client_id=${github_client_id}&redirect_uri=${window.location.href.replace(/\?.*/, "")}`;
});

let github_token = null;

(async () => {
    // Chack 'code' parameter
    await (async () => {
        let m = /code=([^&]+)/.exec(window.location.href);
        if (m) {
            let code = m[1];
            console.log("GitHub Code:", code);
            
            let access_token = await fetch("https://us-central1-ublock-c0a08.cloudfunctions.net/github/get_token", { 
                method: "post",
                body: code,
                redirect: "follow"
            });

            if (access_token.status !== 200) {
                console.error("GitHub Get token error", await access_token.text());
                return;
            }

            access_token = await access_token.text();
            localStorage.setItem("access_token", access_token);
        }
    })();

    // Get user profile
    await (async () => {
        github_token = localStorage.getItem("access_token");
        if (github_token) {
            let user_info = await fetch("https://api.github.com/user", { 
                redirect: "follow",
                headers: { 
                    "Authorization": `token ${github_token}`,
                    "Accept": "application/json"
                }
            });

            if (user_info.status !== 200) {
                console.error("GitHub Get User Info error", await access_token.text());
                return;
            }

            user_info = await user_info.json();
            console.log("User Info", user_info);

            $("#github_avatar").attr("src", user_info.avatar_url).show();
            $("#github-signin").hide();

            NotifyS(`Sign in with GitHub (Username: ${user_info.login})`)
        }
    })();
})();

$("#open-github-dialog").click(() => {
    $("#github-dialog header > ul > li:first-child").click();

    $("#github-repository-list").html("");
    Notiflix.Block.Standard("#github-repository-list", 'Loading...');
    (async() => {
        let list_repo = await fetch("https://api.github.com/user/repos?visibility=public&sort=updated&direction=desc", { 
            redirect: "follow",
            headers: { 
                "Authorization": `token ${github_token}`,
                "Accept": "application/json"
            }
        });

        Notiflix.Block.Remove("#github-repository-list");

        if (list_repo.status !== 200) {
            console.error("GitHub Get Repo error", await list_repo.text());
            return;
        }

        list_repo = await list_repo.json();
        console.log("Repo list", list_repo);

        for (let repo of list_repo) {
            $("#github-repository-list").append(`<li data-url="${repo.full_name}"><i class="fab fa-github-alt"></i> ${repo.full_name.split("/")[0]}/<strong>${repo.full_name.split("/")[1]}</strong></li>`);
        }

        $("#github-repository-list > li").click(function() {
            $("#github-repository-list > li").removeClass("active");
            $(this).addClass("active");
        });
    })();
    
    $("#github-dialog").show();
});

$("#github-dialog .close-btn").click(() => $("#github-dialog").hide());

$("#github-dialog header > ul > li").click(function() {
    let e = $(this).attr("data-active");
    $("#github-dialog > section > section").hide();
    $(e).show();

    $("#github-dialog header > ul > li").removeClass("active");
    $(this).addClass("active");
});

$("#form-github-create-project").submit(function(e) {
    e.preventDefault();

    Notiflix.Block.Standard("#form-github-create-project", 'Loading...');

    return false;
});
